"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { LanguageProvider } from "@/lib/LanguageContext"
import { AppProvider } from "@/lib/AppContext"
import { Toaster } from "@/components/ui/toaster"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const authStatus = localStorage.getItem("isAuthenticated")
    setIsAuthenticated(authStatus === "true")

    if (!authStatus && pathname !== "/login") {
      router.push("/login")
    } else if (authStatus === "true" && pathname === "/login") {
      router.push("/")
    }
  }, [pathname, router])

  const isLoginPage = pathname === "/login"

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AppProvider>
        <LanguageProvider>
          {isLoginPage ? (
            children
          ) : (
            <div className="flex min-h-screen">
              {isAuthenticated && <Sidebar />}
              <div className={`flex-1 flex flex-col ${isAuthenticated ? "ml-64 lg:ml-72" : ""}`}>
                {isAuthenticated && <Header />}
                <main className={`flex-1 p-8 bg-background ${isAuthenticated ? "mt-16" : ""}`}>{children}</main>
              </div>
            </div>
          )}
          <Toaster />
        </LanguageProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
