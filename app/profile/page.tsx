"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Check } from "lucide-react"
import { motion } from "framer-motion"
import { useToast } from "@/components/ui/use-toast"

export default function ProfilePage() {
  const { language } = useLanguage()
  const t = translations[language]
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Cargar los datos del usuario desde localStorage
    const storedName = localStorage.getItem("userName")
    const storedEmail = localStorage.getItem("userEmail")
    if (storedName) setName(storedName)
    if (storedEmail) setEmail(storedEmail)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Guardar los datos actualizados en localStorage
    localStorage.setItem("userName", name)
    localStorage.setItem("userEmail", email)
    setIsSuccess(true)
    toast({
      title: t.profileUpdated,
      description: t.profileUpdatedDescription,
    })
    setTimeout(() => setIsSuccess(false), 2000)
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>{t.profileTitle}</CardTitle>
          <CardDescription>{t.profileDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name">{t.name}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">{t.email}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                  {t.profileUpdated}
                </>
              ) : (
                t.updateProfile
              )}
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </div>
  )
}
