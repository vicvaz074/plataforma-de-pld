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

export function Header() {
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
      className="fixed top-0 right-0 left-64 lg:left-72 border-b bg-white dark:bg-gray-950 z-30"
    >
      <div className="flex h-16 items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Programa de Prevención en Lavado de Dinero
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={language} onValueChange={(value: "es" | "en") => setLanguage(value)}>
            <SelectTrigger className="w-[100px]">
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

          <Button variant="outline" className="gap-2 bg-transparent" onClick={() => router.push("/")}>
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden md:inline-block">Inicio</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
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
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </motion.div>
          </Button>
        </div>
      </div>
    </motion.header>
  )
}
