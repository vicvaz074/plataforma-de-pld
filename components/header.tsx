"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Bell, ChevronDown, Globe, LayoutGrid, LogOut, Moon, Sun, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"
import { CompanySwitcher, usePilot } from "@/components/pilot/pilot-provider"
import { APP_NAVIGATION_ITEMS } from "@/lib/pld/navigation"
import { PATH_MODULES, sessionCan } from "@/lib/pilot/contracts"
import { GlobalSearch } from "@/components/pilot/global-search"
import { SaveStatus } from "@/components/pilot/save-status"

export function Header() {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const router = useRouter()
  const t = translations[language]
  const [userName, setUserName] = useState("")
  const [mounted, setMounted] = useState(false)
  const { session, company, mode, logout } = usePilot()

  useEffect(() => {
    setUserName(localStorage.getItem("userName") || "")
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    try { await logout() } catch { /* Persistent save errors remain visible. */ }
  }

  return (
    <header className="pld-reference-shell fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-white/25 bg-sidebar px-[clamp(22px,2.2vw,50px)] text-white shadow-[0_3px_12px_rgba(94,74,42,0.08)] max-sm:px-3" style={{ height: "var(--app-header-height)" }}>
      <Link href="/" aria-label="Davara Governance, inicio" className="flex h-full shrink-0 items-center">
        <Image
          src="/logo-davara-governance/logo-davara-governance-white.png"
          alt="Davara Governance"
          width={860}
          height={200}
          priority
          className="h-auto w-[clamp(220px,15vw,337px)] object-contain max-sm:!w-[92px] max-sm:!translate-x-0"
          style={{ transform: "translateX(clamp(-68px, -3vw, -14px))" }}
        />
      </Link>

      <div className="flex h-full min-w-0 items-center gap-[clamp(8px,1.1vw,25px)] max-sm:gap-0">
        <CompanySwitcher />
        <SaveStatus />
        <GlobalSearch />
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Abrir navegación" className="text-white hover:bg-white/10 md:hidden"><LayoutGrid className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">{APP_NAVIGATION_ITEMS.filter((item) => !PATH_MODULES[item.href] || mode === "demo" || sessionCan(session, company, PATH_MODULES[item.href], "view")).map((item) => <DropdownMenuItem key={item.key} onSelect={() => router.push(item.href)}>{item.title[language]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
        <Select value={language} onValueChange={(value: "es" | "en") => setLanguage(value)}>
          <SelectTrigger aria-label="Idioma" className="hidden h-[clamp(42px,3vw,62px)] w-[clamp(72px,6.7vw,148px)] gap-2 border-white/55 bg-transparent px-3 text-white hover:bg-white/10 focus:ring-white/60 sm:flex [&>svg]:text-white">
            <Globe className="h-5 w-5 shrink-0" />
            <SelectValue placeholder={language.toUpperCase()} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es">ES</SelectItem>
            <SelectItem value="en">EN</SelectItem>
          </SelectContent>
        </Select>

        <Button asChild variant="outline" className="hidden h-[clamp(42px,3vw,62px)] w-[clamp(170px,11.25vw,252px)] gap-3 border-white/55 bg-transparent px-4 text-[clamp(15px,0.9vw,20px)] text-white hover:bg-white/10 hover:text-white sm:flex max-sm:!hidden">
          <Link href="/dashboard">
            <LayoutGrid className="h-5 w-5" />
            <span style={{ fontWeight: 600 }}>{language === "es" ? "Panel de control" : "Dashboard"}</span>
          </Link>
        </Button>

        <Button variant="ghost" size="icon" aria-label="Abrir avisos e informes" className="hidden w-[clamp(44px,3.1vw,70px)] text-white hover:bg-white/10 hover:text-white sm:flex" onClick={() => router.push("/avisos-informes")}>
          <Bell className="h-6 w-6" strokeWidth={1.8} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" aria-label="Abrir menú de cuenta" className="w-[clamp(40px,11.1vw,249px)] gap-2 px-1 text-[clamp(15px,0.9vw,20px)] text-white hover:bg-white/10 hover:text-white sm:gap-3">
              <UserRound className="h-5 w-5" />
              <span className="hidden md:inline" style={{ fontWeight: 600 }}>{session?.user.name || userName || "Mi cuenta"}</span>
              <ChevronDown className="hidden h-4 w-4 sm:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => router.push("/profile")}>{t.profile}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/settings")}>{t.settings}</DropdownMenuItem>
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />{t.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" aria-label="Cambiar tema" className="hidden text-white hover:bg-white/10 hover:text-white sm:flex" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {!mounted || theme === "light" ? <Sun className="h-6 w-6" strokeWidth={1.8} /> : <Moon className="h-6 w-6" strokeWidth={1.8} />}
        </Button>
      </div>
    </header>
  )
}
