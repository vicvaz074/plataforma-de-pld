"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { LanguageProvider } from "@/lib/LanguageContext"
import { AppProvider } from "@/lib/AppContext"
import { DEFAULT_USERS } from "@/lib/default-users"
import { Toaster } from "@/components/ui/toaster"

const SIDEBAR_EXPANDED_WIDTH = "16.42rem"
const SIDEBAR_COLLAPSED_WIDTH = "5rem"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const storedUsers = JSON.parse(localStorage.getItem("users") || "[]")
    let shouldUpdate = false

    DEFAULT_USERS.forEach((defaultUser) => {
      const exists = storedUsers.some((user: { email: string }) => user.email === defaultUser.email)
      if (!exists) {
        storedUsers.push(defaultUser)
        shouldUpdate = true
      }
    })

    if (shouldUpdate) {
      localStorage.setItem("users", JSON.stringify(storedUsers))
    }
  }, [])

  useEffect(() => {
    const authStatus = localStorage.getItem("isAuthenticated")
    setIsAuthenticated(authStatus === "true")

    if (!authStatus && pathname !== "/login") {
      router.push("/login")
    } else if (authStatus === "true" && pathname === "/login") {
      router.push("/")
    }
  }, [pathname, router])

  useEffect(() => {
    const persisted = localStorage.getItem("sidebarCollapsed")
    if (persisted) {
      setIsSidebarCollapsed(persisted === "true")
    }
  }, [])

  useEffect(() => {
    const updateViewport = () => setIsCompactViewport(window.innerWidth < 768)
    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("sidebarCollapsed", String(next))
      return next
    })
  }

  const isLoginPage = pathname === "/login"
  const effectiveSidebarCollapsed = isCompactViewport || isSidebarCollapsed
  const sidebarOffset = effectiveSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH
  const contentStyle = isAuthenticated
    ? { marginLeft: sidebarOffset, width: `calc(100% - ${sidebarOffset})` }
    : { marginLeft: 0, width: "100%" }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AppProvider>
        <LanguageProvider>
          {isLoginPage ? (
            children
          ) : (
            <div className="flex min-h-screen overflow-x-hidden">
              {isAuthenticated && <Sidebar collapsed={effectiveSidebarCollapsed} onToggle={handleSidebarToggle} />}
              <div className="flex-1 min-w-0 flex flex-col transition-[margin,width] duration-300" style={contentStyle}>
                {isAuthenticated && <Header sidebarOffset={sidebarOffset} showSidebarLogo={isSidebarCollapsed} />}
                <main className={`min-w-0 flex-1 bg-background p-4 sm:p-8 ${isAuthenticated ? "mt-16" : ""}`}>{children}</main>
              </div>
            </div>
          )}
          <Toaster />
        </LanguageProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
