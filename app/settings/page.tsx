"use client"

import type React from "react"

import { useState } from "react"
import { useLanguage } from "@/lib/LanguageContext"
import { useTheme } from "next-themes"
import { translations } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sortAlphabetically } from "@/lib/utils"
import { Check } from "lucide-react"
import { motion } from "framer-motion"

export default function SettingsPage() {
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()
  const t = translations[language]
  const [notifications, setNotifications] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)

  const languageOptions = sortAlphabetically(
    [
      { value: "en", label: "English" },
      { value: "es", label: "Español" },
    ],
    (opt) => opt.label
  )

  const themeOptions = sortAlphabetically(
    [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" },
    ],
    (opt) => opt.label
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simular guardado de configuración
    setTimeout(() => {
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 2000)
    }, 1000)
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>{t.settingsTitle}</CardTitle>
          <CardDescription>Manage your account settings and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="language">{t.language}</Label>
                <Select value={language} onValueChange={(value: "es" | "en") => setLanguage(value)}>
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {languageOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="theme">{t.theme}</Label>
                <Select value={theme} onValueChange={(value) => setTheme(value)}>
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Select Theme" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {themeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
                <Label htmlFor="notifications">{t.notifications}</Label>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button type="submit" onClick={handleSubmit} disabled={isSuccess}>
              {isSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {t.settingsSaved}
                </>
              ) : (
                t.saveSettings
              )}
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </div>
  )
}
