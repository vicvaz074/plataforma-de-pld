"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Database, RotateCcw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { clearPldDemoData, getPldDemoSeedStatus, installPldDemoData } from "@/lib/demo/pld-demo-data"

type DemoStatus = ReturnType<typeof getPldDemoSeedStatus>

export function PldDemoDataControls() {
  const { toast } = useToast()
  const [status, setStatus] = useState<DemoStatus>(null)

  const refreshStatus = () => {
    if (typeof window === "undefined") return
    setStatus(getPldDemoSeedStatus(window.localStorage))
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  const handleInstall = () => {
    const result = installPldDemoData(window.localStorage, new Date("2026-05-08T12:00:00-06:00"))
    refreshStatus()
    toast({
      title: "Datos demo cargados",
      description: `${result.counts.expedientes} expedientes, ${result.counts.operaciones} operaciones y ${result.counts.evidencias} evidencias listas para mostrar.`,
    })
  }

  const handleClear = () => {
    clearPldDemoData(window.localStorage)
    refreshStatus()
    toast({
      title: "Datos demo eliminados",
      description: "Se limpiaron las llaves demo PLD sin tocar idioma ni sesión.",
    })
  }

  return (
    <Card className="mb-6 border-slate-200 bg-slate-50/70 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-slate-900 p-2 text-white">
            <Database className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Demo PLD Actividades Vulnerables</h2>
              {status ? (
                <Badge className="gap-1 bg-emerald-600 text-white">
                  <CheckCircle2 className="h-3 w-3" />
                  Cargada
                </Badge>
              ) : (
                <Badge variant="outline">Sin datos demo</Badge>
              )}
            </div>
            <p className="max-w-3xl text-sm text-slate-600">
              Carga un caso ficticio coherente con registro SAT, KYC, actos, EBR/PEP, avisos, auditoría,
              capacitación, evidencias y gobernanza para presentar la plataforma sin capturar desde cero.
            </p>
            {status && (
              <p className="text-xs text-slate-500">
                {status.subjectName} · {status.counts.expedientes} expedientes · {status.counts.operaciones} operaciones ·{" "}
                {status.counts.hallazgos} hallazgos
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" size="sm" onClick={handleInstall}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {status ? "Restaurar demo" : "Cargar demo"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleClear} disabled={!status}>
            <Trash2 className="mr-2 h-4 w-4" />
            Limpiar demo
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
