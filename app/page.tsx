"use client"

import { useState, useEffect } from "react"
import { useLanguage } from "@/lib/LanguageContext"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import {
  Shield,
  FileCheck,
  Users,
  FileText,
  GraduationCap,
  Search,
  Database,
  Settings,
  Sparkles,
  Book,
  ClipboardCheck,
  UserSearch,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { translations } from "@/lib/translations"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { PldDemoDataControls } from "@/components/pld-demo-data-controls"
import { PLD_DASHBOARD_MODULES } from "@/lib/pld/navigation"

type HomeOption = {
  name: string
  icon: LucideIcon
  href: string
  image?: string
  external?: boolean
}

const homeIcons: Record<string, LucideIcon> = {
  FileCheck,
  Users,
  Shield,
  ClipboardCheck,
  UserSearch,
  FileText,
  GraduationCap,
  Search,
  Database,
  Settings,
  Book,
  Sparkles,
}

const options: HomeOption[] = PLD_DASHBOARD_MODULES.map((module) => ({
  name: module.key,
  icon: homeIcons[module.iconName] ?? FileText,
  href: module.href,
  image:
    module.key === "alicia"
      ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fondo9.png-AqM6pGQFnW7wv6Mud4R4MHeOdJx6s4.jpeg"
      : undefined,
}))

export default function Home() {
  const { language } = useLanguage()
  const t = translations[language]
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    const shouldShowWelcome = localStorage.getItem("showPostLoginWelcome") === "true"
    setShowWelcome(shouldShowWelcome)
  }, [])

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#18181b]">
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar text-white"
          >
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
              className="flex flex-col items-center max-w-3xl text-center px-6"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 1.5 }}
                className="mb-14"
              >
                <Image
                  src="/logo-davara-governance/logo-davara-governance-white.png"
                  alt="DavaraGovernance Logo"
                  width={180}
                  height={60}
                  unoptimized
                  priority
                  className="opacity-90 brightness-0 invert"
                />
              </motion.div>

              <h1 className="text-2xl md:text-3xl font-light tracking-[0.05em] mb-2 text-white/90">
                Bienvenido a la Plataforma de Prevención en Lavado de Dinero
              </h1>

              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 1.0, duration: 1, ease: "easeInOut" }}
                className="w-16 h-[1px] bg-white/40 my-10 mx-auto transform origin-center"
              />

              <p className="text-base md:text-lg text-white/70 mb-16 max-w-2xl font-light leading-loose tracking-wide">
                Gestiona, protege y audita la información de manera segura, en estricto cumplimiento normativo.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4, duration: 0.8 }}
              >
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setShowWelcome(false)
                    localStorage.removeItem("showPostLoginWelcome")
                  }}
                  className="bg-transparent border border-white/30 text-white/90 hover:bg-white hover:text-sidebar transition-all duration-500 rounded-sm px-14 py-6 text-xs tracking-[0.2em] font-light uppercase"
                >
                  Continuar
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <div className="container mx-auto py-8">
        <PldDemoDataControls />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {options.map((option) => {
            const dashboardModule = PLD_DASHBOARD_MODULES.find((item) => item.key === option.name)
            const optionTitle = dashboardModule?.title[language] ?? t[option.name] ?? option.name
            const optionDescription = dashboardModule?.description[language] ?? t[option.name + "Description"] ?? ""
            const CardContent = (
              <Card
                className="p-6 hover:shadow-lg transition-shadow flex flex-col items-center justify-center h-[200px] cursor-pointer group relative overflow-hidden"
                onMouseEnter={() => setHoveredCard(option.name)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {option.image ? (
                  <div className="absolute inset-0 w-full h-full">
                    <Image
                      src={option.image || "/placeholder.svg"}
                      alt={optionTitle}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-20" />
                  </div>
                ) : (
                  <option.icon className="h-10 w-10 mb-4 text-gray-600 group-hover:text-gray-800 transition-colors" />
                )}
                <span
                  className={`text-base font-medium text-center transition-colors leading-tight ${
                    option.image
                      ? `text-white relative z-10 ${option.name === "alicia" ? "group-hover:opacity-0" : ""}`
                      : "text-gray-700 group-hover:text-gray-900"
                  }`}
                  style={{ fontFamily: "Futura Std, sans-serif" }}
                >
                  {option.name === "alicia" ? (
                    <Image
                      src="/Alicia_Sin_Despachos.png"
                      alt="Alicia"
                      width={130}
                      height={40}
                      className="object-contain relative z-10"
                      unoptimized
                    />
                  ) : optionTitle}
                </span>
                <motion.div
                  className="absolute inset-0 bg-white bg-opacity-90 p-4 flex items-center justify-center text-sm text-gray-700 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: hoveredCard === option.name ? 1 : 0,
                    y: hoveredCard === option.name ? 0 : 20,
                  }}
                  transition={{ duration: 0.3 }}
                  style={{ pointerEvents: hoveredCard === option.name ? "auto" : "none" }}
                >
                  {optionDescription}
                </motion.div>
              </Card>
            )

            if (option.external) {
              return (
                <a key={option.name} href={option.href} target="_blank" rel="noopener noreferrer">
                  {CardContent}
                </a>
              )
            }

            return (
              <Link key={option.name} href={option.href}>
                {CardContent}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
