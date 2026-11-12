"use client"
import { useSyncExternalStore } from "react"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { getSaveState, subscribeSaveState, type SaveState } from "@/lib/pilot/module-storage"
import { usePilot } from "./pilot-provider"
const initial: SaveState = { status: "saved", pending: 0 }
export function SaveStatus() {
  const { mode, company } = usePilot()
  const state = useSyncExternalStore(subscribeSaveState, getSaveState, () => initial)
  if (mode !== "cloud" || !company) return null
  const label = state.status === "saved" ? "Servidor sincronizado" : state.status === "saving" ? "Guardando en servidor" : "Cambios sin sincronizar"
  const Icon = state.status === "saved" ? CheckCircle2 : state.status === "saving" ? Loader2 : AlertCircle
  return <span role="status" aria-label={label} title={`${label}. Este estado corresponde a los guardados enviados; utiliza Guardar o Guardar borrador para conservar un formulario en captura.`} className="flex shrink-0 items-center gap-1 px-1 text-xs text-white"><Icon className={`h-4 w-4 ${state.status === "saving" ? "animate-spin" : ""}`} /><span className="hidden xl:inline">{label}</span></span>
}
