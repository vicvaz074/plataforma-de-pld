"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"
import { sortAlphabetically } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, LineChart, PieChart } from "@/components/ui/charts"
import { UserProgressDashboard } from "@/components/user-progress-dashboard"
import { AdminUserPrivileges } from "@/components/admin-user-privileges"
import { getDocuments, DOCUMENT_STORAGE_KEY } from "@/lib/documents"
import { ALERT_STORAGE_KEY, getAlerts } from "@/lib/alerts"
import type { AlertRecord } from "@/lib/alerts"

type TrendPoint = { name: string; value: number }

type AlertDistribution = { name: string; value: number }

function buildMonthlyTrend(timestamps: (string | undefined)[], locale: string): TrendPoint[] {
  const now = new Date()
  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const monthLabel = date.toLocaleString(locale, { month: "short" })
    const count = timestamps.filter((timestamp) => {
      if (!timestamp) return false
      const time = new Date(timestamp)
      return time.getFullYear() === date.getFullYear() && time.getMonth() === date.getMonth()
    }).length
    return { name: monthLabel, value: count }
  })
}

function buildAlertDistributionData(alerts: AlertRecord[], labels: {
  danger: string
  warning: string
  info: string
}): AlertDistribution[] {
  const summary = alerts.reduce(
    (acc, alert) => {
      if (alert.status === "resolved") return acc
      acc[alert.severity] = (acc[alert.severity] ?? 0) + 1
      return acc
    },
    { danger: 0, warning: 0, info: 0 } as Record<"danger" | "warning" | "info", number>,
  )

  return [
    { name: labels.danger, value: summary.danger },
    { name: labels.warning, value: summary.warning },
    { name: labels.info, value: summary.info },
  ]
}

export default function DashboardPage() {
  const { language } = useLanguage()
  const t = translations[language]
  const [userRole, setUserRole] = useState<string | null>(null)
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [selectedMetric, setSelectedMetric] = useState("users")
  const [dashboardData, setDashboardData] = useState({
    totalUsers: 0,
    totalDocuments: 0,
    pendingReviews: 0,
    completedActivities: 0,
  })
  const [userTrend, setUserTrend] = useState<TrendPoint[]>([])
  const [documentTrend, setDocumentTrend] = useState<TrendPoint[]>([])
  const [alertDistribution, setAlertDistribution] = useState<AlertDistribution[]>([])

  const locale = language === "es" ? "es-MX" : "en-US"

  const syncDashboard = useCallback(() => {
    setUserRole(localStorage.getItem("userRole"))
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    setPendingUsers(users.filter((u: any) => !u.approved))

    const documents = getDocuments()
    const alerts = getAlerts()

    setDashboardData({
      totalUsers: users.filter((u: any) => u.approved).length,
      totalDocuments: documents.length,
      pendingReviews: users.filter((u: any) => !u.approved).length,
      completedActivities: JSON.parse(localStorage.getItem("completedActivities") || "[]").length,
    })

    setUserTrend(buildMonthlyTrend(users.map((user: any) => user.createdAt), locale))
    setDocumentTrend(buildMonthlyTrend(documents.map((doc) => doc.uploadedAt), locale))
    setAlertDistribution(
      buildAlertDistributionData(alerts, {
        danger: t.criticalAlerts,
        warning: t.warningAlerts,
        info: t.infoAlerts,
      }),
    )
  }, [locale, t.criticalAlerts, t.infoAlerts, t.warningAlerts])

  useEffect(() => {
    syncDashboard()

    const handleStorageUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>
      if (!customEvent.detail || [DOCUMENT_STORAGE_KEY, ALERT_STORAGE_KEY].includes(customEvent.detail.key ?? "")) {
        syncDashboard()
      }
    }

    const handleNativeStorage = (event: StorageEvent) => {
      if ([DOCUMENT_STORAGE_KEY, ALERT_STORAGE_KEY, "users", "completedActivities"].includes(event.key ?? "")) {
        syncDashboard()
      }
    }

    window.addEventListener("pld-storage-updated", handleStorageUpdate)
    window.addEventListener("storage", handleNativeStorage)

    return () => {
      window.removeEventListener("pld-storage-updated", handleStorageUpdate)
      window.removeEventListener("storage", handleNativeStorage)
    }
  }, [syncDashboard])

  const handleApprove = (email: string) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const updatedUsers = users.map((u: any) => (u.email === email ? { ...u, approved: true } : u))
    localStorage.setItem("users", JSON.stringify(updatedUsers))
    syncDashboard()
  }

  const handleReject = (email: string) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const updatedUsers = users.filter((u: any) => u.email !== email)
    localStorage.setItem("users", JSON.stringify(updatedUsers))
    syncDashboard()
  }

  const metricsOptions = useMemo(
    () =>
      sortAlphabetically(
        [
          { value: "users", label: t.usersMetric },
          { value: "documents", label: t.documentsMetric },
          { value: "alerts", label: t.alertsMetric },
        ],
        (opt) => opt.label,
      ),
    [t.alertsMetric, t.documentsMetric, t.usersMetric],
  )

  const AdminDashboard = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <h1 className="text-2xl font-bold">{t.dashboard}</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.totalUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.totalDocuments}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalDocuments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.pendingReviews}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.pendingReviews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.completedActivities}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.completedActivities}</div>
          </CardContent>
        </Card>
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
        className="mt-4"
      >
        {t.downloadUserAccounts}
      </Button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-semibold mt-8 mb-4">{t.pendingApprovals}</h2>
        {pendingUsers.length === 0 ? (
          <p>{t.noPendingApprovals}</p>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((user: any) => (
              <Card key={user.email}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <div className="space-x-2">
                    <Button onClick={() => handleApprove(user.email)} variant="outline">
                      {t.approve}
                    </Button>
                    <Button onClick={() => handleReject(user.email)} variant="destructive">
                      {t.reject}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
      <AdminUserPrivileges />
    </motion.div>
  )

  const AnalyticsDashboard = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t.dashboard}</h1>

      <Select onValueChange={setSelectedMetric} value={selectedMetric}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder={t.selectMetric} />
        </SelectTrigger>
        <SelectContent>
          {metricsOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {selectedMetric === "users" && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>{t.usersMetric}</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={userTrend} xKey="name" yKey="value" />
            </CardContent>
          </Card>
        )}
        {selectedMetric === "documents" && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>{t.documentsMetric}</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart data={documentTrend} xKey="name" yKey="value" />
            </CardContent>
          </Card>
        )}
        {selectedMetric === "alerts" && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>{t.alertsMetric}</CardTitle>
            </CardHeader>
            <CardContent>
              <PieChart data={alertDistribution} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )

  if (userRole === "admin") {
    return (
      <div className="container mx-auto py-10">
        <AdminDashboard />
      </div>
    )
  }

  if (userRole === "analyst") {
    return (
      <div className="container mx-auto py-10">
        <AnalyticsDashboard />
      </div>
    )
  }

  return <UserProgressDashboard />
}
