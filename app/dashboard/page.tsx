"use client"

import { useEffect, useState } from "react"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { UserProgressDashboard } from "@/components/user-progress-dashboard"
import { AdminUserPrivileges } from "@/components/admin-user-privileges"
import { PLD_DASHBOARD_MODULES } from "@/lib/pld/navigation"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, Database, ShieldCheck, Users } from "lucide-react"

const parseLocalStorageValue = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null")
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

export default function DashboardPage() {
  const { language } = useLanguage()
  const t = translations[language]
  const [userRole, setUserRole] = useState<string | null>(null)
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [dashboardData, setDashboardData] = useState({
    usuariosActivos: 0,
    usuariosPendientes: 0,
    sujetosObligados: 0,
    expedientesEui: 0,
    operaciones: 0,
    paquetesSat: 0,
  })

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole"))
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    setPendingUsers(users.filter((u: any) => !u.approved))

    const registroSat = parseLocalStorageValue("registro-sat-data")
    const expedientes = parseLocalStorageValue("kyc_expedientes_detalle")
    const operaciones = parseLocalStorageValue("actividades_vulnerables_operaciones")
    const paquetesSat = parseLocalStorageValue("pld-sat-output-packages")

    setDashboardData({
      usuariosActivos: users.filter((u: any) => u.approved).length,
      usuariosPendientes: users.filter((u: any) => !u.approved).length,
      sujetosObligados: countStoredRecords(registroSat, ["sujetosRegistrados", "tenants"]),
      expedientesEui: countStoredRecords(expedientes, ["expedientes", "items"]),
      operaciones: countStoredRecords(operaciones, ["operaciones", "items"]),
      paquetesSat: countStoredRecords(paquetesSat, ["packages", "paquetes", "items"]),
    })
  }, [])

  const handleApprove = (email: string) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const updatedUsers = users.map((u: any) => (u.email === email ? { ...u, approved: true } : u))
    localStorage.setItem("users", JSON.stringify(updatedUsers))
    setPendingUsers(updatedUsers.filter((u: any) => !u.approved))
    setDashboardData((prev) => ({
      ...prev,
      usuariosActivos: prev.usuariosActivos + 1,
      usuariosPendientes: Math.max(prev.usuariosPendientes - 1, 0),
    }))
  }

  const handleReject = (email: string) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const updatedUsers = users.filter((u: any) => u.email !== email)
    localStorage.setItem("users", JSON.stringify(updatedUsers))
    setPendingUsers(updatedUsers.filter((u: any) => !u.approved))
    setDashboardData((prev) => ({
      ...prev,
      usuariosPendientes: Math.max(prev.usuariosPendientes - 1, 0),
    }))
  }

  const AdminDashboard = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-7xl px-4 py-6 text-slate-950 sm:px-6 lg:px-8"
    >
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Administración PLD</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">Salud del sistema</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Vista rápida para decidir si faltan datos, usuarios por aprobar o salidas SAT por cerrar.
          </p>
        </div>
        <Button
          onClick={() => {
            const users = JSON.parse(localStorage.getItem("users") || "[]")
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users))
            const downloadAnchorNode = document.createElement("a")
            downloadAnchorNode.setAttribute("href", dataStr)
            downloadAnchorNode.setAttribute("download", "users.json")
            document.body.appendChild(downloadAnchorNode)
            downloadAnchorNode.click()
            downloadAnchorNode.remove()
          }}
          variant="outline"
          className="shrink-0 bg-transparent"
        >
          {t.downloadUserAccounts}
        </Button>
      </header>

      <section className="grid gap-6 py-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 text-slate-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Resumen local</p>
          <div className="mt-5 grid grid-cols-2 gap-5">
            {[
              ["Usuarios", dashboardData.usuariosActivos, Users],
              ["Pendientes", dashboardData.usuariosPendientes, AlertTriangle],
              ["Sujetos", dashboardData.sujetosObligados, ShieldCheck],
              ["EUI", dashboardData.expedientesEui, Database],
            ].map(([label, value, Icon]) => {
              const MetricIcon = Icon as typeof Users
              return (
                <div key={String(label)} className="min-w-0">
                  <MetricIcon className="mb-3 h-5 w-5 text-orange-700" />
                  <p className="text-3xl font-semibold">{String(value)}</p>
                  <p className="mt-1 text-xs text-slate-600">{String(label)}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-6 border-t border-orange-200 pt-5">
            <p className="text-xs text-orange-700">Operación y SAT</p>
            <p className="mt-1 text-2xl font-semibold">
              {dashboardData.operaciones}
              <span className="text-base text-slate-500"> operación(es)</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">{dashboardData.paquetesSat} paquete(s) SAT preparado(s)</p>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-medium tracking-normal">Pendientes administrativos</h2>
            <p className="text-sm text-slate-500">Acciones concretas, no métricas decorativas.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingUsers.length > 0 ? (
              pendingUsers.slice(0, 4).map((user: any) => (
                <div key={user.email} className="flex min-w-0 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-slate-950">Aprobar acceso: {user.name}</p>
                    <p className="break-words text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleApprove(user.email)}>
                      {t.approve}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReject(user.email)}>
                      {t.reject}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-600">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                No hay usuarios pendientes de aprobación.
              </div>
            )}
            {!dashboardData.sujetosObligados ? (
              <Link href="/registro-sat" className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50">
                <span>
                  <span className="block text-sm font-medium text-slate-950">Falta sujeto obligado demo/productivo</span>
                  <span className="text-xs text-slate-500">Registra alta SAT para habilitar flujo EUI y operaciones.</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-y border-slate-200 py-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="text-lg font-medium tracking-normal">Cobertura por módulo</h2>
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {PLD_DASHBOARD_MODULES.map((module) => (
              <Link key={module.key} href={module.href} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-950">{module.title[language]}</span>
                  <span className="block truncate text-xs text-slate-500">{module.description[language]}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
        <details className="rounded-xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer text-lg font-medium tracking-normal text-slate-950">
            Administración de accesos por módulo
          </summary>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Usa este detalle solo cuando necesites auditar o ajustar permisos por usuario.
          </p>
          <AdminUserPrivileges />
        </details>
      </section>
    </motion.div>
  )

  if (userRole === "admin") {
    return (
      <div className="w-full">
        <AdminDashboard />
      </div>
    )
  } else {
    return <UserProgressDashboard />
  }
}
