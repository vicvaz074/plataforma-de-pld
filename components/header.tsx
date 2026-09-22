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

export function Header() {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const router = useRouter()
  const t = translations[language]
  const [userName, setUserName] = useState("")

  useEffect(() => {
    setUserName(localStorage.getItem("userName") || "")
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userName")
    localStorage.removeItem("userEmail")
    router.push("/login")
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
          className="h-auto w-[clamp(220px,15vw,337px)] object-contain max-sm:!w-[120px]"
          style={{ transform: "translateX(clamp(-68px, -3vw, -14px))" }}
        />
      </Link>

      <div className="flex h-full items-center gap-[clamp(8px,1.1vw,25px)]">
        <Select value={language} onValueChange={(value: "es" | "en") => setLanguage(value)}>
          <SelectTrigger aria-label="Idioma" className="h-[clamp(42px,3vw,62px)] w-[clamp(72px,6.7vw,148px)] gap-2 border-white/55 bg-transparent px-3 text-white hover:bg-white/10 focus:ring-white/60 [&>svg]:text-white">
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

        <Button variant="ghost" size="icon" aria-label="Abrir avisos e informes" className="w-[clamp(44px,3.1vw,70px)] text-white hover:bg-white/10 hover:text-white" onClick={() => router.push("/avisos-informes")}>
          <Bell className="h-6 w-6" strokeWidth={1.8} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-[clamp(40px,11.1vw,249px)] gap-2 px-1 text-[clamp(15px,0.9vw,20px)] text-white hover:bg-white/10 hover:text-white sm:gap-3">
              <UserRound className="h-5 w-5" />
              <span className="hidden md:inline" style={{ fontWeight: 600 }}>{userName || "Administrador"}</span>
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

        <Button variant="ghost" size="icon" aria-label="Cambiar tema" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Sun className="h-6 w-6" strokeWidth={1.8} /> : <Moon className="h-6 w-6" strokeWidth={1.8} />}
        </Button>
      </div>
    </header>
  )
}
