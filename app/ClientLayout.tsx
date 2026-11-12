"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { LanguageProvider } from "@/lib/LanguageContext"
import { Toaster } from "@/components/ui/toaster"
import { PilotProvider, usePilot } from "@/components/pilot/pilot-provider"

function ApplicationShell({ children }: { children: React.ReactNode }) {
  const { mode, session } = usePilot()
  const [demoAuthenticated, setDemoAuthenticated] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [compact, setCompact] = useState(false)
  const pathname = usePathname(); const router = useRouter()
  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 768)
    update(); window.addEventListener("resize", update)
    setCollapsed(localStorage.getItem("sidebarCollapsed") === "true")
    return () => window.removeEventListener("resize", update)
  }, [])
  useEffect(() => {
    if (mode !== "demo") return
    const authenticated = localStorage.getItem("isAuthenticated") === "true"
    setDemoAuthenticated(authenticated)
    if (!authenticated && pathname !== "/login") router.replace("/login")
    if (authenticated && pathname === "/login") router.replace("/")
  }, [pathname, mode, router])
  const authenticated = mode === "cloud" ? Boolean(session) : demoAuthenticated
  const sidebarCollapsed = compact || collapsed
  const offset = compact ? "0px" : sidebarCollapsed ? "5rem" : "clamp(15rem, 16.9vw, 24rem)"
  if (pathname === "/login" || pathname === "/setup") return <>{children}</>
  return <div className="flex min-h-screen overflow-x-clip" style={{ "--app-header-height": "68px" } as React.CSSProperties}>
    {authenticated && !compact && <Sidebar collapsed={sidebarCollapsed} onToggle={() => setCollapsed((value) => { localStorage.setItem("sidebarCollapsed", String(!value)); return !value })} />}
    <div className="flex min-w-0 flex-1 flex-col transition-[margin,width] duration-200" style={{ marginLeft: authenticated ? offset : 0, width: authenticated ? `calc(100% - ${offset})` : "100%" }}>
      {authenticated && <Header />}
      <main className={`min-w-0 flex-1 bg-background ${pathname === "/" ? "p-0" : "p-4 sm:p-6 lg:p-8"}`} style={authenticated ? { marginTop: "var(--app-header-height)" } : undefined}>{children}</main>
    </div>
  </div>
}
export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange><LanguageProvider><PilotProvider><ApplicationShell>{children}</ApplicationShell></PilotProvider><Toaster /></LanguageProvider></ThemeProvider>
}
