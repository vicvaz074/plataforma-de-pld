"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/LanguageContext"
import { useRouter } from "next/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { translations } from "@/lib/translations"
import { sortAlphabetically } from "@/lib/utils"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Moon, Sun, Globe, User, ChevronDown, LogOut, LayoutDashboard } from "lucide-react"
import Image from "next/image"

type HeaderProps = {
  sidebarOffset: string
  showSidebarLogo: boolean
}

export function Header({ sidebarOffset, showSidebarLogo }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const router = useRouter()
  const t = translations[language]
  const [userName, setUserName] = useState("")
  const languageOptions = sortAlphabetically(["en", "es"])

  useEffect(() => {
    const storedUserName = localStorage.getItem("userName")
    if (storedUserName) {
      setUserName(storedUserName)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userName")
    localStorage.removeItem("userEmail")
    router.push("/login")
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 right-0 border-b bg-white text-black z-30"
      style={{ left: sidebarOffset }}
    >
      <div className="flex h-16 items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3">
            {showSidebarLogo && (
              <Image
                src="/images/design-mode/image.png"
                alt="Davara Governance"
                width={140}
                height={36}
                className="h-9 w-auto object-contain"
                priority
              />
            )}
            <h1 className="text-lg font-normal text-black">Programa de Prevención en Lavado de Dinero</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={language} onValueChange={(value: "es" | "en") => setLanguage(value)}>
            <SelectTrigger className="w-[100px] text-black">
              <Globe className="mr-2 h-4 w-4" />
              <SelectValue placeholder={language.toUpperCase()} />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="gap-2 bg-transparent text-black" onClick={() => router.push("/")}>
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden md:inline-block">Inicio</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 text-black">
                <User className="h-4 w-4" />
                <span className="hidden md:inline-block">{userName || "Administrador"}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push("/profile")}>{t.profile}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/settings")}>{t.settings}</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleLogout}>
                <motion.div className="flex items-center" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.logout}
                </motion.div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: theme === "light" ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              {theme === "light" ? <Moon className="h-5 w-5 text-black" /> : <Sun className="h-5 w-5 text-black" />}
            </motion.div>
          </Button>
        </div>
      </div>
    </motion.header>
  )
}
