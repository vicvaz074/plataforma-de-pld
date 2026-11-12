"use client"
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Building2, Users, Activity, Shield, Plus, Search, KeyRound, UserX, UserCheck, Copy, Settings2, LayoutDashboard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/pld/searchable-select"
import { CompanyEditor } from "./company-editor"
import { UserSecurityDialog } from "./user-security-dialog"
import { createCompanyWithOrganization } from "./admin-onboarding"
import { usePilot } from "./pilot-provider"
import { jsonRequest, pilotApi } from "@/lib/pilot/api"
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, isValidPasswordLength } from "@/lib/pilot/password-policy"
import { ALL_ACTIONS, MODULE_LABELS, rolePermissions, sessionIsAdmin, type AdminSnapshot, type Company, type CompanyGrant, type ModuleKey, type Organization, type OrganizationRole, type PilotUser } from "@/lib/pilot/contracts"

const ROLE_LABELS: Record<OrganizationRole,string> = {admin:"Administrador",compliance:"Cumplimiento",capture:"Captura",viewer:"Consulta"}
const ACTION_LABELS:Record<string,string> = {view:"Ver",edit:"Editar",upload:"Cargar",download:"Descargar",approve:"Aprobar",archive:"Archivar"}
const normalize=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
const formatAccess=(value:string|number)=>new Date(typeof value==="number"||/^\d+$/.test(value)?Number(value):value).toLocaleString("es-MX")
const empty:AdminSnapshot={organizations:[],companies:[],users:[],memberships:[],grants:[],audit:[]}

export function AdminDashboard() {
  const {session,company,refresh:refreshSession,selectCompany}=usePilot()
  const [data,setData]=useState<AdminSnapshot>(empty);const [error,setError]=useState("");const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true);const [hasLoaded,setHasLoaded]=useState(false)
  const [search,setSearch]=useState("");const [tab,setTab]=useState("summary")
  const [dialog,setDialog]=useState<"company"|"user"|"organization"|null>(null)
  const [organizationId,setOrganizationId]=useState("");const [name,setName]=useState("");const [email,setEmail]=useState("");const [rfc,setRfc]=useState("")
  const [organizationName,setOrganizationName]=useState("")
  const [initialPassword,setInitialPassword]=useState("")
  const setupHandled=useRef(false)
  const [role,setRole]=useState<OrganizationRole>("capture");const [companyIds,setCompanyIds]=useState<string[]>([])
  const [credential,setCredential]=useState<{email:string;password?:string;initialPasswordSet?:boolean}|null>(null)
  const [permissionsUser,setPermissionsUser]=useState<PilotUser|null>(null);const [permissionsCompany,setPermissionsCompany]=useState("")
  const [editingCompany,setEditingCompany]=useState<Company|null>(null)
  const [securityUser,setSecurityUser]=useState<PilotUser|null>(null)
  const [permissions,setPermissions]=useState<CompanyGrant["permissions"]>({})
  const superadmin=session?.user.platformRole==="superadmin"
  const isAdmin=sessionIsAdmin(session)
  const userId=session?.user.id
  const load=useCallback(async()=>{setLoading(true);setError("");try{const result=await pilotApi<AdminSnapshot>("/admin");setData(result);setHasLoaded(true);setOrganizationId(value=>value||result.organizations[0]?.id||"")}catch(reason){setError(reason instanceof Error?reason.message:"No se pudo cargar el panel.")}finally{setLoading(false)}},[])
  useEffect(()=>{if(isAdmin)void load()},[load,isAdmin,userId])
  const mutate=async(path:string,method:string,body:unknown,refreshActor=!path.endsWith("/reset-password"))=>{setBusy(true);setError("");try{const result=await pilotApi<Record<string,unknown>>(path,jsonRequest(method,body));if(path==="/users"&&method==="POST")setInitialPassword("");await load();if(refreshActor)await refreshSession();return result}catch(reason){if(path==="/users"&&method==="POST")setInitialPassword("");setError(reason instanceof Error?reason.message:"No se pudo guardar.");return null}finally{setBusy(false)}}
  const companies=data.companies.filter(item=>normalize(`${item.name} ${item.rfc}`).includes(normalize(search)))
  const users=data.users.filter(item=>normalize(`${item.name} ${item.email}`).includes(normalize(search)))
  const scopedCompanies=data.companies.filter(item=>item.organizationId===organizationId&&item.status==="active")
  const open=useCallback((kind:"company"|"user"|"organization"|null)=>{setError("");setName("");setEmail("");setRfc("");setInitialPassword("");setCompanyIds([]);setRole("capture");setDialog(kind)},[])
  useEffect(()=>{
    if(!hasLoaded||loading||!isAdmin||setupHandled.current)return
    const url=new URL(window.location.href)
    if(new URLSearchParams(url.search).get("setup")!=="company")return
    setupHandled.current=true
    setTab("companies");open("company")
    url.searchParams.delete("setup")
    window.history.replaceState(window.history.state,"",`${url.pathname}${url.search}${url.hash}`)
  },[hasLoaded,loading,isAdmin,open])
  const submit=async(event:FormEvent)=>{
    event.preventDefault()
    if(busy)return
    if(dialog==="company"){
      setBusy(true);setError("")
      try{
        const created=await createCompanyWithOrganization({organizationId,organizationName,name,rfc},{
          superadmin,
          createOrganization:organizationName=>pilotApi<Organization>("/organizations",jsonRequest("POST",{name:organizationName})),
          rememberOrganization:organization=>{
            setOrganizationId(organization.id)
            setData(previous=>({...previous,organizations:previous.organizations.some(item=>item.id===organization.id)?previous.organizations:[...previous.organizations,organization]}))
          },
          createCompany:input=>pilotApi<Company>("/companies",jsonRequest("POST",input)),
        })
        setDialog(null)
        // Revalidate first, selecting the new company from the authoritative session.
        // The provider deliberately remounts company-bound screens after this switch.
        await refreshSession({companyId:created.id})
      }catch(reason){setError(reason instanceof Error?reason.message:"No se pudo crear la empresa.")}
      finally{setBusy(false)}
      return
    }
    if(dialog==="user"&&initialPassword&&!isValidPasswordLength(initialPassword)){setError(`La contraseña inicial debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`);return}
    const result=await mutate(dialog==="organization"?"/organizations":"/users","POST",{organizationId,name,email,rfc,role,...(dialog==="user"&&initialPassword?{initialPassword}:{}),companyIds},dialog!=="user")
    if(result){setInitialPassword("");setDialog(null);if(result.initialPasswordSet===true)setCredential({email,initialPasswordSet:true});else if(typeof result.temporaryPassword==="string")setCredential({email,password:result.temporaryPassword})}
  }
  const memberOrganization=(user:PilotUser)=>data.memberships.find(item=>item.userId===user.id)?.organizationId||organizationId
  const selectPermissionUser=(user:PilotUser)=>{if(data.memberships.some(item=>item.userId===user.id&&item.role==="admin")){setSecurityUser(user);return}setPermissionsUser(user);const id=data.companies.find(item=>item.organizationId===memberOrganization(user))?.id||"";setPermissionsCompany(id);setPermissions(data.grants.find(item=>item.userId===user.id&&item.companyId===id)?.permissions||{})}
  const organizationOptions=data.organizations.map(item=>({value:item.id,label:item.name}))
  const firstCompany=!data.companies.some(item=>item.status==="active")
  const companyAction=tab==="companies"||firstCompany
  const needsOrganization=dialog==="company"&&superadmin&&!data.organizations.length&&!organizationId
  const counts=useMemo(()=>[{label:"Empresas",value:data.companies.filter(item=>item.status==="active").length,icon:Building2},{label:"Usuarios activos",value:data.users.filter(item=>item.status==="active").length,icon:Users},{label:"Organizaciones",value:data.organizations.length,icon:Shield}], [data])
  if(!sessionIsAdmin(session))return <div className="mx-auto max-w-3xl space-y-4"><h1 className="text-2xl font-semibold">Mi espacio</h1><p className="text-muted-foreground">{company?.name||"Selecciona una empresa para consultar tu trabajo."}</p><Button onClick={()=>window.location.assign("/")}>Abrir módulos</Button></div>
  if(!hasLoaded)return loading?<div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center gap-3"><Loader2 aria-hidden="true" className="size-5 animate-spin"/>Cargando administración…</div>:<Alert variant="destructive"><AlertTitle>No se pudo cargar la administración</AlertTitle><AlertDescription><p>{error}</p><Button className="mt-3" variant="outline" onClick={()=>void load()}>Reintentar</Button></AlertDescription></Alert>
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold">Administración</h1>{superadmin&&<Badge variant="secondary">Superadministrador global</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{superadmin?"Control de organizaciones, empresas, usuarios y módulos. Los datos se conservan separados por empresa.":"Empresas y accesos de tu organización"}</p></div><Button className="gap-2 rounded-xl" onClick={()=>open(companyAction?"company":"user")} disabled={busy||loading||(!data.organizations.length&&(!superadmin||!companyAction))}><Plus data-icon="inline-start" aria-hidden="true"/>{companyAction?"Nueva empresa":"Nuevo usuario"}</Button></header>
    {firstCompany&&<Alert role="status"><Building2 aria-hidden="true"/><AlertTitle>Crea tu primera empresa</AlertTitle><AlertDescription><p>{superadmin&&!data.organizations.length?"Da de alta tu organización y tu primera empresa en un solo paso. Después podrás trabajar en todos los módulos PLD.":"Agrega una empresa para comenzar a trabajar en los módulos PLD y asignar accesos a tu equipo."}</p><Button className="mt-4 gap-2" disabled={busy||loading||(!superadmin&&!data.organizations.length)} onClick={()=>{setTab("companies");open("company")}}><Plus data-icon="inline-start" aria-hidden="true"/>Crear primera empresa</Button></AlertDescription></Alert>}
    {error&&!dialog&&<Alert variant="destructive"><AlertTitle>No se pudo completar la solicitud</AlertTitle><AlertDescription><p>{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={()=>void load()}>Actualizar</Button></AlertDescription></Alert>}
    <Tabs value={tab} onValueChange={setTab}><TabsList className="flex h-auto w-fit flex-wrap rounded-xl bg-slate-100 p-1">{[{id:"summary",label:"Resumen",icon:LayoutDashboard},{id:"companies",label:"Empresas",icon:Building2},{id:"users",label:"Usuarios",icon:Users},{id:"activity",label:"Actividad",icon:Activity}].map(item=><TabsTrigger key={item.id} value={item.id} className="gap-2 rounded-lg"><item.icon className="h-4 w-4"/>{item.label}</TabsTrigger>)}</TabsList>
      <TabsContent value="summary" className="space-y-6 pt-4"><div className="grid gap-4 sm:grid-cols-3">{counts.map(item=><button key={item.label} onClick={()=>setTab(item.label==="Usuarios activos"?"users":"companies")} className="rounded-2xl border bg-white p-5 text-left transition hover:border-orange-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-orange-400"><item.icon className="mb-4 h-5 w-5 text-orange-500"/><p className="text-3xl font-semibold">{item.value}</p><p className="mt-1 text-sm text-muted-foreground">{item.label}</p></button>)}</div><section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 font-semibold">Organizaciones</h2>{data.organizations.map(org=><div key={org.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-4 first:border-t-0"><span>{org.name}</span><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">MFA {org.mfaEnabled?"activado":"desactivado"}</span>{superadmin&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>{if(window.confirm(org.mfaEnabled?"¿Desactivar la política MFA de esta organización?":"Los usuarios de esta organización deberán configurar un autenticador. ¿Activar MFA?"))void mutate(`/organizations/${org.id}`,"PATCH",{mfaEnabled:!org.mfaEnabled})}}>{org.mfaEnabled?"Desactivar MFA":"Activar MFA"}</Button>}</div></div>)}{superadmin&&<Button className="mt-3 gap-2 rounded-xl" variant="outline" onClick={()=>open("organization")}><Plus className="h-4 w-4"/>Crear organización</Button>}</section></TabsContent>
      <TabsContent value="companies" className="space-y-4 pt-4"><AdminSearch value={search} onChange={setSearch} label="Buscar empresa o RFC"/>{companies.map(item=><section key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><h2 className="font-medium">{item.name}</h2><p className="mt-1 text-sm text-muted-foreground">{item.rfc} · {data.organizations.find(org=>org.id===item.organizationId)?.name}</p></div><div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={()=>setEditingCompany(item)}>Editar empresa</Button><Button variant="outline" className="rounded-xl" onClick={()=>void selectCompany(item).then(()=>window.location.assign("/registro-sat")).catch(reason=>setError(String(reason)))}>Abrir empresa</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>{if(window.confirm(`¿${item.status==="active"?"Archivar":"Reactivar"} ${item.name}?`))void mutate(`/companies/${item.id}`,"PATCH",{status:item.status==="active"?"archived":"active"})}}>{item.status==="active"?"Archivar":"Reactivar"}</Button></div></section>)}{!companies.length&&<p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay empresas que coincidan.</p>}</TabsContent>
      <TabsContent value="users" className="space-y-4 pt-4"><AdminSearch value={search} onChange={setSearch} label="Buscar nombre o correo"/>{users.map(user=>{const memberships=data.memberships.filter(m=>m.userId===user.id);return <section key={user.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div className="min-w-0"><h2 className="font-medium">{user.name}</h2><p className="break-all text-sm text-muted-foreground">{user.email}</p><p className="mt-1 text-xs text-muted-foreground">{user.platformRole==="superadmin"?"Superadministrador":memberships.map(m=>ROLE_LABELS[m.role]).join(", ")} · {user.status==="active"?"Activo":"Suspendido"}{user.requiresPasswordChange?" · Cambio de contraseña pendiente":""}</p><p className="mt-1 text-xs text-muted-foreground">Último acceso: {user.lastAccess?formatAccess(user.lastAccess):"Sin ingreso registrado"}</p></div>{user.platformRole!=="superadmin"&&(superadmin||!memberships.some(item=>item.role==="admin"))&&<div className="flex flex-wrap gap-1"><Button variant="ghost" size="sm" onClick={()=>setSecurityUser(user)}>Cuenta y sesiones</Button><Button variant="ghost" size="sm" title="Empresas y permisos" aria-label={`Configurar accesos de ${user.name}`} onClick={()=>selectPermissionUser(user)}><Settings2 className="h-4 w-4"/></Button><Button variant="ghost" size="sm" title="Restablecer contraseña" aria-label={`Restablecer contraseña de ${user.name}`} onClick={async()=>{if(!window.confirm("Se cerrarán las sesiones del usuario y se generará una contraseña temporal. ¿Continuar?"))return;const result=await mutate(`/users/${user.id}/reset-password`,"POST",{organizationId:memberOrganization(user)});if(typeof result?.temporaryPassword==="string")setCredential({email:user.email,password:result.temporaryPassword})}}><KeyRound className="h-4 w-4"/></Button><Button variant="ghost" size="sm" disabled={busy} title={user.status==="active"?"Suspender":"Reactivar"} aria-label={`${user.status==="active"?"Suspender":"Reactivar"} a ${user.name}`} onClick={()=>void mutate(`/users/${user.id}`,"PATCH",{organizationId:memberOrganization(user),status:user.status==="active"?"suspended":"active"})}>{user.status==="active"?<UserX className="h-4 w-4"/>:<UserCheck className="h-4 w-4"/>}</Button></div>}</section>})}</TabsContent>
      <TabsContent value="activity" className="pt-4"><div className="divide-y rounded-2xl border bg-white">{data.audit.map((event,index)=><div key={event.id||index} className="grid gap-1 p-4 text-sm sm:grid-cols-[1fr_2fr_auto]"><span className="font-medium">{data.users.find(user=>user.id===event.actorId)?.name||event.actorId}</span><span>{event.action}</span><time className="text-xs text-muted-foreground">{event.createdAt?new Date(event.createdAt).toLocaleString("es-MX"):""}</time></div>)}{!data.audit.length&&<p className="p-8 text-center text-sm text-muted-foreground">La actividad aparecerá aquí.</p>}</div></TabsContent>
    </Tabs>
    <CompanyEditor company={editingCompany} onClose={()=>setEditingCompany(null)} onSaved={async()=>{await load();await refreshSession()}}/>
    <UserSecurityDialog user={securityUser} organizationId={securityUser?memberOrganization(securityUser):organizationId} initialRole={data.memberships.find(item=>item.userId===securityUser?.id)?.role||"viewer"} superadmin={superadmin} onClose={()=>setSecurityUser(null)} onChanged={load}/>
    <Dialog open={Boolean(dialog)} onOpenChange={open=>{if(!open&&!busy){setInitialPassword("");setDialog(null)}}}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dialog==="organization"?"Nueva organización":dialog==="company"?"Nueva empresa":"Nuevo usuario"}</DialogTitle>
          <DialogDescription>{dialog==="user"?"Crea su cuenta y selecciona las empresas a las que podrá acceder.":needsOrganization?"Primero da un nombre a tu organización y completa los datos de tu empresa. Podrás agregar más empresas después.":"Completa los datos básicos para comenzar."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error&&<Alert variant="destructive"><AlertTitle>No se pudo guardar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            <legend className="sr-only">Datos de {dialog==="company"?"la empresa":dialog==="organization"?"la organización":"la cuenta"}</legend>
            {needsOrganization?<div className="flex flex-col gap-2">
              <Label htmlFor="admin-organization-name">Nombre de organización</Label>
              <Input id="admin-organization-name" value={organizationName} onChange={event=>setOrganizationName(event.target.value)} required maxLength={200} aria-describedby="admin-organization-help"/>
              <p id="admin-organization-help" className="text-sm text-muted-foreground">La organización agrupa a tus empresas y a tu equipo. No sustituye la razón social ni el RFC de la empresa.</p>
            </div>:dialog!=="organization"&&<div className="flex flex-col gap-2">
              <Label>Organización</Label>
              <SearchableSelect value={organizationId} options={organizationOptions} onChange={value=>{setOrganizationId(value);setCompanyIds([])}} disabled={busy} ariaLabel="Organización"/>
            </div>}
            <div className="flex flex-col gap-2"><Label htmlFor="admin-name">{dialog==="company"?"Razón social":"Nombre"}</Label><Input id="admin-name" value={name} onChange={event=>setName(event.target.value)} required maxLength={200}/></div>
            {dialog==="company"&&<div className="flex flex-col gap-2"><Label htmlFor="admin-rfc">RFC</Label><Input id="admin-rfc" value={rfc} onChange={event=>setRfc(event.target.value.toUpperCase())} required maxLength={13}/></div>}
            {dialog==="user"&&<>
              <div className="flex flex-col gap-2"><Label htmlFor="admin-email">Correo electrónico</Label><Input id="admin-email" type="email" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={254}/></div>
              <div className="flex flex-col gap-2"><Label htmlFor="admin-initial-password">Contraseña inicial (opcional)</Label><Input id="admin-initial-password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} aria-describedby="admin-initial-password-help" value={initialPassword} onChange={event=>setInitialPassword(event.target.value)}/><p id="admin-initial-password-help" className="text-sm text-muted-foreground">Entre {PASSWORD_MIN_LENGTH} y {PASSWORD_MAX_LENGTH} caracteres. Si la dejas vacía, se genera una contraseña temporal. El usuario deberá cambiarla al entrar.</p></div>
              <div className="flex flex-col gap-2"><Label>Perfil</Label><SearchableSelect value={role} onChange={value=>setRole(value as OrganizationRole)} options={Object.entries(ROLE_LABELS).filter(([key])=>superadmin||key!=="admin").map(([value,label])=>({value,label}))} disabled={busy} ariaLabel="Perfil del usuario"/></div>
              <fieldset className="flex flex-col gap-2"><legend className="mb-2 text-sm font-medium">Empresas autorizadas</legend>{scopedCompanies.map(item=><label key={item.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={companyIds.includes(item.id)} onChange={event=>setCompanyIds(previous=>event.target.checked?[...previous,item.id]:previous.filter(id=>id!==item.id))}/>{item.name}</label>)}</fieldset>
            </>}
          </fieldset>
          <Button type="submit" disabled={busy||dialog!=="organization"&&!needsOrganization&&!organizationId} className="w-full rounded-xl">{busy?"Guardando…":needsOrganization?"Crear organización y empresa":dialog==="company"?"Crear empresa":"Crear"}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={()=>{setInitialPassword("");setDialog(null)}}>Cancelar</Button>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(credential)} onOpenChange={open=>{if(!open)setCredential(null)}}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Acceso creado</DialogTitle><DialogDescription>{credential?.initialPasswordSet?"La contraseña inicial quedó registrada y no se volverá a mostrar. El usuario deberá cambiarla al entrar.":"La contraseña temporal se muestra una sola vez. El usuario deberá cambiarla al entrar."}</DialogDescription></DialogHeader><p className="break-all text-sm">{credential?.email}</p>{credential?.password&&<div className="flex gap-2"><Input readOnly aria-label="Contraseña temporal" value={credential.password}/><Button variant="outline" aria-label="Copiar contraseña temporal" onClick={()=>void navigator.clipboard.writeText(credential.password||"")}><Copy className="h-4 w-4"/></Button></div>}<Button onClick={()=>setCredential(null)}>{credential?.initialPasswordSet?"Entendido":"Ya la guardé"}</Button></DialogContent></Dialog>
    <Dialog open={Boolean(permissionsUser)} onOpenChange={open=>{if(!open)setPermissionsUser(null)}}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>Accesos de {permissionsUser?.name}</DialogTitle><DialogDescription>Selecciona una empresa y ajusta las acciones permitidas.</DialogDescription></DialogHeader><SearchableSelect value={permissionsCompany} options={data.companies.filter(item=>permissionsUser&&item.organizationId===memberOrganization(permissionsUser)).map(item=>({value:item.id,label:item.name}))} onChange={id=>{setPermissionsCompany(id);setPermissions(data.grants.find(item=>item.userId===permissionsUser?.id&&item.companyId===id)?.permissions||{})}} ariaLabel="Empresa cuyos permisos se editan"/><div className="flex flex-wrap gap-2">{(["compliance","capture","viewer"] as OrganizationRole[]).map(profile=><Button key={profile} size="sm" variant="outline" onClick={()=>setPermissions(rolePermissions(profile))}>{ROLE_LABELS[profile]}</Button>)}<Button size="sm" variant="ghost" onClick={()=>setPermissions({})}>Retirar acceso</Button></div><div className="space-y-3">{Object.entries(MODULE_LABELS).map(([key,label])=><fieldset key={key} className="rounded-xl border p-3"><legend className="px-1 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{ALL_ACTIONS.map(action=><label key={action} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={permissions[key as ModuleKey]?.includes(action)||false} onChange={e=>setPermissions(previous=>({...previous,[key]:e.target.checked?[...(previous[key as ModuleKey]||[]),action]:(previous[key as ModuleKey]||[]).filter(value=>value!==action)}))}/>{ACTION_LABELS[action]}</label>)}</div></fieldset>)}</div><Button disabled={busy||!permissionsCompany} onClick={async()=>{if(!permissionsUser)return;const result=await mutate("/grants","PUT",{organizationId:memberOrganization(permissionsUser),userId:permissionsUser.id,companyId:permissionsCompany,permissions});if(result)setPermissionsUser(null)}}>Guardar permisos</Button></DialogContent></Dialog>
  </div>
}
function AdminSearch({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}){return <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="rounded-xl pl-10" aria-label={label} placeholder={label} value={value} onChange={e=>onChange(e.target.value)}/></div>}
