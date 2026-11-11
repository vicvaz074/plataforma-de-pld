"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useTheme } from "next-themes"
import { useLanguage } from "@/lib/LanguageContext"
import { usePilot } from "@/components/pilot/pilot-provider"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SearchableSelect } from "@/components/pld/searchable-select"
import { pilotApi, jsonRequest } from "@/lib/pilot/api"

type Preferences = { language: "es" | "en"; theme: "light" | "dark" | "system"; notifications: boolean }
export default function SettingsPage() {
  const { mode } = usePilot(); const { language, setLanguage } = useLanguage(); const { theme, setTheme } = useTheme()
  const [values, setValues] = useState<Preferences>({ language: "es", theme: "light", notifications: true })
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false)
  const initialLocalPreferences = useRef({ language, theme })
  useEffect(() => {
    if (mode === "cloud") void pilotApi<{ preferences: Preferences }>("/profile").then(({ preferences }) => { setValues(preferences); setLanguage(preferences.language); setTheme(preferences.theme) }).catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las preferencias."))
    else { const { language, theme } = initialLocalPreferences.current; setValues({ language, theme: ["light", "dark", "system"].includes(theme || "") ? theme as Preferences["theme"] : "light", notifications: localStorage.getItem("pld-notifications") !== "false" }) }
  }, [mode, setLanguage, setTheme])
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false)
    try { if (mode === "cloud") await pilotApi("/profile", jsonRequest("PATCH", { preferences: values })); else localStorage.setItem("pld-notifications", String(values.notifications)); setLanguage(values.language); setTheme(values.theme); setSaved(true) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se guardaron las preferencias.") } finally { setBusy(false) }
  }
  return <div className="mx-auto max-w-xl space-y-5"><h1 className="text-2xl font-semibold">Configuración</h1><p className="text-sm text-muted-foreground">Preferencias personales. Los recordatorios son internos; no se envían correos desde esta pantalla.</p>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{saved && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">Preferencias guardadas{mode === "cloud" ? " en tu cuenta" : " en este navegador"}.</p>}<form onSubmit={save} className="space-y-5 rounded-2xl border bg-white p-5"><div className="space-y-2"><Label>Idioma</Label><SearchableSelect ariaLabel="Idioma de la interfaz" value={values.language} onChange={(value) => { setSaved(false); setValues({ ...values, language: value as Preferences["language"] }) }} options={[{ value: "es", label: "Español" }, { value: "en", label: "English" }]} /></div><div className="space-y-2"><Label>Apariencia</Label><SearchableSelect ariaLabel="Apariencia de la interfaz" value={values.theme} onChange={(value) => { setSaved(false); setValues({ ...values, theme: value as Preferences["theme"] }) }} options={[{ value: "light", label: "Clara" }, { value: "dark", label: "Oscura" }, { value: "system", label: "Seguir el dispositivo" }]} /></div><div className="flex items-center justify-between gap-4"><Label htmlFor="local-reminders">Mostrar recordatorios internos</Label><Switch id="local-reminders" checked={values.notifications} onCheckedChange={(notifications) => { setSaved(false); setValues({ ...values, notifications }) }} /></div><Button disabled={busy} className="rounded-xl">{busy ? "Guardando…" : "Guardar preferencias"}</Button></form></div>
}
