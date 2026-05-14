"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileCheck,
  FileText,
  Search,
  Shield,
  UserSearch,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { PLD_DASHBOARD_MODULES } from "@/lib/pld/navigation"

type Snapshot = {
  sujetos: number
  expedientes: number
  operaciones: number
  ebr: number
  evidencias: number
  paquetesSat: number
  pepConsultas: number
}

type WorkItem = {
  id: string
  label: string
  detail: string
  href: string
  status: "bloqueado" | "atencion" | "listo"
  icon: React.ComponentType<{ className?: string }>
}

const parseLocalStorageValue = (key: string): unknown => {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null")
  } catch {
    return null
  }
}

const countStoredRecords = (value: unknown, arrayKeys: string[] = []) => {
  if (Array.isArray(value)) return value.length
  if (!value || typeof value !== "object") return 0

  const record = value as Record<string, unknown>
  for (const key of arrayKeys) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate.length
  }
  return Object.keys(record).length > 0 ? 1 : 0
}

const readSnapshot = (): Snapshot => ({
  sujetos: countStoredRecords(parseLocalStorageValue("registro-sat-data"), ["sujetosRegistrados", "tenants"]),
  expedientes: countStoredRecords(parseLocalStorageValue("kyc_expedientes_detalle"), ["expedientes", "items"]),
  operaciones: countStoredRecords(parseLocalStorageValue("actividades_vulnerables_operaciones"), ["operaciones", "items"]),
  ebr: countStoredRecords(parseLocalStorageValue("ebr_evaluaciones"), ["evaluaciones", "items"]),
  evidencias: countStoredRecords(parseLocalStorageValue("pld-evidences-documents"), ["documents", "items"]),
  paquetesSat: countStoredRecords(parseLocalStorageValue("pld-sat-output-packages"), ["packages", "paquetes", "items"]),
  pepConsultas: countStoredRecords(parseLocalStorageValue("pld-pep-search-history"), ["items"]),
})

const statusTone = {
  bloqueado: "bg-rose-50 text-rose-700 border-rose-200",
  atencion: "bg-amber-50 text-amber-800 border-amber-200",
  listo: "bg-emerald-50 text-emerald-700 border-emerald-200",
}

const statusLabel = {
  bloqueado: "Bloqueado",
  atencion: "Atención",
  listo: "Listo",
}

function buildWorkItems(snapshot: Snapshot): WorkItem[] {
  const items: WorkItem[] = []

  if (!snapshot.sujetos) {
    items.push({
      id: "alta-sat",
      label: "Alta SAT sin sujeto obligado",
      detail: "Sin un sujeto obligado registrado no hay contexto para EUI, operaciones ni salidas SAT.",
      href: "/registro-sat",
      status: "bloqueado",
      icon: FileCheck,
    })
  }

  if (snapshot.sujetos > 0 && !snapshot.expedientes) {
    items.push({
      id: "eui",
      label: "Falta expediente único de identificación",
      detail: "Crea o vincula el EUI del cliente para precargar datos y evidencia documental.",
      href: "/kyc-expediente",
      status: "bloqueado",
      icon: Users,
    })
  }

  if (snapshot.expedientes > 0 && !snapshot.operaciones) {
    items.push({
      id: "operacion",
      label: "No hay actos u operaciones del periodo",
      detail: "Registra la operación con el formato SAT correspondiente a la fracción aplicable.",
      href: "/actividades-vulnerables",
      status: "atencion",
      icon: Shield,
    })
  }

  if (snapshot.operaciones > 0 && !snapshot.paquetesSat) {
    items.push({
      id: "sat",
      label: "Operaciones sin paquete SAT",
      detail: "Genera o revisa XML, XLSM, ficha de captura y campos faltantes.",
      href: "/avisos-informes",
      status: "atencion",
      icon: FileText,
    })
  }

  if (snapshot.operaciones > 0 && !snapshot.ebr) {
    items.push({
      id: "ebr",
      label: "Riesgo pendiente de documentar",
      detail: "Evalúa riesgo inherente, controles mitigantes y riesgo residual.",
      href: "/ebr",
      status: "atencion",
      icon: ClipboardCheck,
    })
  }

  if (snapshot.expedientes > 0 && !snapshot.pepConsultas) {
    items.push({
      id: "pep",
      label: "Sin consulta WhoIs PEP registrada",
      detail: "Valida cliente, representante o beneficiario controlador con fuentes locales cargadas.",
      href: "/pep-whois",
      status: "atencion",
      icon: UserSearch,
    })
  }

  if (snapshot.operaciones > 0 && !snapshot.evidencias) {
    items.push({
      id: "evidencia",
      label: "Evidencia operativa no centralizada",
      detail: "Revisa documentos críticos, versiones y trazabilidad del expediente.",
      href: "/evidencias-trazabilidad",
      status: "atencion",
      icon: Database,
    })
  }

  if (items.length === 0) {
    items.push({
      id: "revision-periodo",
      label: "Periodo listo para revisión",
      detail: "Revisa acuses, bitácora y acciones correctivas antes de cerrar el periodo.",
      href: "/avisos-informes",
      status: "listo",
      icon: CheckCircle2,
    })
  }

  return items.slice(0, 5)
}

function buildWorkflow(snapshot: Snapshot) {
  return [
    { label: "Alta SAT", href: "/registro-sat", done: snapshot.sujetos > 0 },
    { label: "EUI", href: "/kyc-expediente", done: snapshot.expedientes > 0 },
    { label: "Operación", href: "/actividades-vulnerables", done: snapshot.operaciones > 0 },
    { label: "Riesgo", href: "/ebr", done: snapshot.ebr > 0 },
    { label: "Evidencia", href: "/evidencias-trazabilidad", done: snapshot.evidencias > 0 },
    { label: "Salida SAT", href: "/avisos-informes", done: snapshot.paquetesSat > 0 },
  ]
}

export const UserProgressDashboard = () => {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    sujetos: 0,
    expedientes: 0,
    operaciones: 0,
    ebr: 0,
    evidencias: 0,
    paquetesSat: 0,
    pepConsultas: 0,
  })

  useEffect(() => {
    const refresh = () => setSnapshot(readSnapshot())
    refresh()
    window.addEventListener("pld-demo-data-changed", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("pld-demo-data-changed", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  const workItems = useMemo(() => buildWorkItems(snapshot), [snapshot])
  const workflow = useMemo(() => buildWorkflow(snapshot), [snapshot])
  const nextItem = workItems.find((item) => item.status !== "listo") ?? workItems[0]
  const completedSteps = workflow.filter((step) => step.done).length

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Panel operativo PLD</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">Qué atender ahora</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Prioriza pendientes reales del flujo: alta SAT, expediente, operación, riesgo, evidencia y salida SAT.
          </p>
        </div>
        <Link href={nextItem.href} className="shrink-0">
          <Button className="gap-2 bg-[#F7941D] text-white hover:bg-[#D97808]">
            Continuar trabajo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </header>

      <section className="grid gap-6 py-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-medium tracking-normal">Atención del periodo</h2>
              <p className="text-sm text-slate-500">Ordenado por bloqueo operativo y utilidad para cerrar el mes.</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>

          <div className="divide-y divide-slate-100">
            {workItems.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.id} href={item.href} className="group flex min-w-0 items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-slate-950">{item.label}</span>
                    <span className="mt-1 block break-words text-xs leading-5 text-slate-500">{item.detail}</span>
                  </span>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusTone[item.status]}`}>
                    {statusLabel[item.status]}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-slate-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Siguiente acción</p>
          <h2 className="mt-3 text-xl font-medium tracking-normal">{nextItem.label}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{nextItem.detail}</p>
          <Link href={nextItem.href} className="mt-6 inline-flex">
            <Button className="gap-2 bg-[#F7941D] text-white hover:bg-[#D97808]">
              Abrir módulo
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div className="mt-6 border-t border-amber-200 pt-4">
            <p className="text-xs text-amber-700">Avance del flujo</p>
            <p className="mt-1 text-3xl font-semibold">
              {completedSteps}
              <span className="text-base text-slate-500">/{workflow.length}</span>
            </p>
          </div>
        </aside>
      </section>

      <section className="border-y border-slate-200 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium tracking-normal">Ruta PLD del periodo</h2>
            <p className="text-sm text-slate-500">Una lectura rápida de qué ya existe y qué falta para operar.</p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-6">
          {workflow.map((step, index) => (
            <Link key={step.label} href={step.href} className="group min-w-0">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs ${step.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-slate-800">{step.label}</span>
              </div>
              <div className={`mt-3 h-1 rounded-full ${step.done ? "bg-emerald-500" : "bg-slate-200"}`} />
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-8 py-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-lg font-medium tracking-normal">Indicadores locales</h2>
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {[
              ["Sujetos obligados", snapshot.sujetos],
              ["Expedientes EUI", snapshot.expedientes],
              ["Operaciones", snapshot.operaciones],
              ["Paquetes SAT", snapshot.paquetesSat],
              ["Evidencias", snapshot.evidencias],
              ["Consultas PEP", snapshot.pepConsultas],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-600">{label}</span>
                <span className="text-lg font-semibold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium tracking-normal">Módulos disponibles</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {PLD_DASHBOARD_MODULES.map((module) => (
              <Link
                key={module.key}
                href={module.href}
                className="group flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 transition hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{module.title.es}</span>
                  <span className="block truncate text-xs text-slate-500">{module.description.es}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
