"use client"

import { useEffect, useState } from "react"
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

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole"))
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    setPendingUsers(users.filter((u: any) => !u.approved))

    // Calcular datos precisos para el dashboard del administrador
    setDashboardData({
      totalUsers: users.filter((u: any) => u.approved).length,
      totalDocuments: JSON.parse(localStorage.getItem("documents") || "[]").length,
      pendingReviews: users.filter((u: any) => !u.approved).length,
      completedActivities: JSON.parse(localStorage.getItem("completedActivities") || "[]").length,
    })
  }, [])

  const handleApprove = (email: string) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const updatedUsers = users.map((u: any) => (u.email === email ? { ...u, approved: true } : u))
    localStorage.setItem("users", JSON.stringify(updatedUsers))
    setPendingUsers(updatedUsers.filter((u: any) => !u.approved))
    setDashboardData((prev) => ({
      ...prev,
      totalUsers: prev.totalUsers + 1,
      pendingReviews: prev.pendingReviews - 1,
    }))
  }

  const handleReject = (email: string) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const updatedUsers = users.filter((u: any) => u.email !== email)
    localStorage.setItem("users", JSON.stringify(updatedUsers))
    setPendingUsers(updatedUsers.filter((u: any) => !u.approved))
    setDashboardData((prev) => ({
      ...prev,
      pendingReviews: prev.pendingReviews - 1,
    }))
  }

  // Datos de muestra más realistas para el dashboard del usuario
  const userData = [
    { name: "Jan", users: 10 },
    { name: "Feb", users: 15 },
    { name: "Mar", users: 20 },
    { name: "Apr", users: 25 },
    { name: "May", users: 30 },
    { name: "Jun", users: 35 },
  ]

  const revenueData = [
    { name: "Jan", revenue: 1000 },
    { name: "Feb", revenue: 1500 },
    { name: "Mar", revenue: 2000 },
    { name: "Apr", revenue: 2500 },
    { name: "May", revenue: 3000 },
    { name: "Jun", revenue: 3500 },
  ]

  const activityData = [
    { name: "ROPA", value: 40 },
    { name: "Documents", value: 30 },
    { name: "Reviews", value: 20 },
    { name: "Others", value: 10 },
  ]

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

      <Select onValueChange={setSelectedMetric} defaultValue={selectedMetric}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t.selectMetric} />
        </SelectTrigger>
        <SelectContent>
          {sortAlphabetically(
            [
              { value: "users", label: t.users },
              { value: "revenue", label: t.revenue },
              { value: "activities", label: t.activities },
            ],
            (opt) => opt.label
          ).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t.dailyUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={userData} xKey="name" yKey="users" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.monthlyRevenue}</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart data={revenueData} xKey="name" yKey="revenue" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.activityDistribution}</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart data={activityData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // Si el usuario es administrador, mostrar el dashboard de administrador
  // Si es un usuario regular, mostrar el panel de progreso de usuario
  if (userRole === "admin") {
    return (
      <div className="container mx-auto py-10">
        <AdminDashboard />
      </div>
    )
  } else {
    return <UserProgressDashboard />
  }
}
