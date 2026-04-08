"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Moon, Sun, Globe } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { hashPassword, saveUser, authenticateUser } from "@/lib/auth"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Image from "next/image"
import { useTheme } from "next-themes"

export default function LoginPage() {
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()
  const t = translations[language]
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isLogin && (!name || !email || !password)) {
      setAlert({ type: "error", message: t.fillAllFields })
      return
    }

    if (isLogin && (!email || !password)) {
      setAlert({ type: "error", message: t.fillAllFields })
      return
    }

    if (isLogin) {
      const { authenticated, user } = await authenticateUser(email, password)
      if (authenticated) {
        localStorage.setItem("isAuthenticated", "true")
        localStorage.setItem("userRole", user.role || "user")
        localStorage.setItem("userName", user.name)
        localStorage.setItem("userEmail", user.email)
        localStorage.setItem("showPostLoginWelcome", "true")
        router.push("/")
      } else {
        setAlert({ type: "error", message: t.invalidCredentials })
      }
    } else {
      const hashedPassword = await hashPassword(password)
      saveUser({ name, email, password: hashedPassword })
      setAlert({ type: "success", message: t.accountCreatedDescription })
      setIsLogin(true)
    }
  }

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [alert])

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800"
    >
      <Card className="w-[350px] shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Image
              src={
                theme === "dark"
                  ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo_davara-KcaOVhCtK3W2FgCpstE1O8Fhwhn96V.png"
                  : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-kjXWUOCHXzNyL5405gToF9AVq2ODJI.png"
              }
              alt="Davara Abogados"
              width={theme === "dark" ? 180 : 252}
              height={theme === "dark" ? 60 : 84}
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">{isLogin ? t.loginTitle : t.registerTitle}</CardTitle>
          <CardDescription className="text-center">
            {isLogin ? t.loginDescription : t.registerDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              {!isLogin && (
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="name">{t.name}</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">{t.email}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">{t.password}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <motion.div
                      animate={{ scale: showPassword ? 0 : 1, opacity: showPassword ? 0 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <EyeOff className="h-4 w-4" />
                    </motion.div>
                    <motion.div
                      animate={{ scale: showPassword ? 1 : 0, opacity: showPassword ? 1 : 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ position: "absolute" }}
                    >
                      <Eye className="h-4 w-4" />
                    </motion.div>
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full">
            <Button
              className="w-full bg-[#2E7D73] hover:bg-[#246158] text-white dark:text-white"
              onClick={handleSubmit}
            >
              {isLogin ? t.loginButton : t.registerButton}
            </Button>
          </motion.div>
          <Button variant="link" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? t.switchToRegister : t.switchToLogin}
          </Button>
          <div className="flex justify-between items-center w-full gap-2">
            <div className="flex-1">
              <Select value={language} onValueChange={(value: "es" | "en") => setLanguage(value)}>
                <SelectTrigger className="w-full">
                  <Globe className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t.language} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={toggleTheme}
                aria-label={theme === "light" ? t.darkMode : t.lightMode}
              >
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <span>{theme === "light" ? t.darkMode : t.lightMode}</span>
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50"
          >
            <Alert variant={alert.type === "success" ? "default" : "destructive"}>
              <AlertTitle>{alert.type === "success" ? t.success : t.error}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
